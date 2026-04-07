import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, updateDoc, addDoc, collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { logoutUser } from "@/lib/firebaseAuth";
import { haversineDistance } from "@/lib/geo";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin, Navigation, LogOut, CheckCircle2, Circle, LocateFixed } from "lucide-react";

interface Clinic {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

interface RouteDoc {
  id: string;
  mrId: string;
  mrName: string;
  status: string;
  createdAt: number;
  clinics: Clinic[];
}

interface Visit {
  clinicId: string;
}

const MRDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<RouteDoc | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPos = useRef<GeolocationPosition | null>(null);

  const mrId = user?.uid || "";
  const mrName = user?.email || "MR";

  // Listen for assigned route
  useEffect(() => {
    if (!mrId) return;
    const unsub = onSnapshot(
      query(collection(db, "routes"), where("mrId", "==", mrId), where("status", "in", ["assigned", "in-progress"])),
      (snap) => {
        if (snap.docs.length > 0) {
          const d = snap.docs[0];
          setRoute({ id: d.id, ...d.data() } as RouteDoc);
        } else {
          setRoute(null);
        }
      }
    );
    return () => unsub();
  }, [mrId]);

  // Listen for visits on this route
  useEffect(() => {
    if (!route) return;
    const unsub = onSnapshot(
      query(collection(db, "visits"), where("routeId", "==", route.id)),
      (snap) => setVisits(snap.docs.map((d) => d.data() as Visit))
    );
    return () => unsub();
  }, [route?.id]);

  const pushLocation = useCallback(async (pos: GeolocationPosition) => {
    const data = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setCurrentPos(data);
    try {
      // Update live location
      await setDoc(doc(db, "locations", mrId), {
        name: mrName,
        lat: data.lat,
        lng: data.lng,
        timestamp: Date.now(),
      });
    } catch { /* silent */ }
  }, [mrId, mrName]);

  const pushHistory = useCallback(async (pos: GeolocationPosition) => {
    if (!mrId) return;
    try {
      await addDoc(collection(db, "history", mrId, "points"), {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now(),
      });
    } catch { /* silent */ }
  }, [mrId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPos.current = pos;
        pushLocation(pos);
      },
      () => toast.error("Location access denied"),
      { enableHighAccuracy: true }
    );
    // Push history every 20s
    intervalRef.current = setInterval(() => {
      if (latestPos.current) {
        pushLocation(latestPos.current);
        pushHistory(latestPos.current);
      }
    }, 20000);
    // Also push first history point
    if (latestPos.current) pushHistory(latestPos.current);
    toast.success("GPS Tracking started");
  }, [pushLocation, pushHistory]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    toast.info("GPS Tracking stopped");
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const handleToggle = (on: boolean) => {
    setTracking(on);
    on ? startTracking() : stopTracking();
  };

  const isCheckedIn = (clinicId: string) => visits.some((v) => v.clinicId === clinicId);
  const allChecked = route ? route.clinics.every((c) => isCheckedIn(c.id)) : false;

  const distanceTo = (clinic: Clinic) => {
    if (!currentPos) return Infinity;
    return haversineDistance(currentPos.lat, currentPos.lng, clinic.lat, clinic.lng);
  };

  const handleCheckIn = async (clinic: Clinic) => {
    if (!route || !currentPos) return;
    const dist = distanceTo(clinic);
    if (dist > 100) { toast.error(`Too far (${Math.round(dist)}m). Move within 100m to check in.`); return; }
    setCheckingIn(clinic.id);
    try {
      await addDoc(collection(db, "visits"), {
        routeId: route.id,
        mrId,
        clinicId: clinic.id,
        clinicName: clinic.name,
        lat: currentPos.lat,
        lng: currentPos.lng,
        checkedInAt: Date.now(),
      });
      // Update route status to in-progress if assigned
      if (route.status === "assigned") {
        await updateDoc(doc(db, "routes", route.id), { status: "in-progress" });
      }
      toast.success(`Check-in successful — ${clinic.name}`);
    } catch (e: any) {
      toast.error("Check-in failed");
    }
    setCheckingIn(null);
  };

  const handleCompleteRoute = async () => {
    if (!route || !allChecked) return;
    try {
      await updateDoc(doc(db, "routes", route.id), { status: "completed" });
      toast.success("Route completed!");
    } catch {
      toast.error("Failed to complete route");
    }
  };

  const handleLogout = async () => {
    stopTracking();
    await logoutUser();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{mrName}</h1>
          <p className="text-xs text-muted-foreground">Medical Representative</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>

      {/* GPS Tracking */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> GPS Tracking
            </span>
            <Switch checked={tracking} onCheckedChange={handleToggle} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg p-4 text-center ${tracking ? "bg-primary/10" : "bg-muted"}`}>
            {tracking ? (
              <>
                <div className="h-3 w-3 rounded-full bg-green-500 mx-auto mb-2 animate-pulse" />
                <p className="text-sm font-medium">Tracking Active</p>
                {currentPos && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentPos.lat.toFixed(4)}, {currentPos.lng.toFixed(4)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Toggle to start sharing location</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assigned Route */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" /> Assigned Route
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!route ? (
            <p className="text-sm text-muted-foreground text-center py-4">No route assigned</p>
          ) : (
            <div className="space-y-3">
              {route.clinics
                .sort((a, b) => a.order - b.order)
                .map((clinic) => {
                  const checked = isCheckedIn(clinic.id);
                  const dist = distanceTo(clinic);
                  const withinRange = dist <= 100;
                  return (
                    <div key={clinic.id} className={`flex items-center gap-3 rounded-lg border p-3 ${checked ? "bg-primary/5 border-primary/30" : ""}`}>
                      {checked ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${checked ? "line-through text-muted-foreground" : ""}`}>
                          {clinic.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {clinic.lat.toFixed(4)}, {clinic.lng.toFixed(4)}
                          {currentPos && !checked && (
                            <span className={`ml-1 ${withinRange ? "text-green-600" : "text-destructive"}`}>
                              · {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                            </span>
                          )}
                        </p>
                      </div>
                      {!checked && (
                        <Button
                          size="sm"
                          variant={withinRange ? "default" : "outline"}
                          disabled={!withinRange || !currentPos || checkingIn === clinic.id}
                          onClick={() => handleCheckIn(clinic)}
                          className="gap-1 shrink-0 text-xs sm:text-sm"
                        >
                          <LocateFixed className="h-3 w-3" />
                          {checkingIn === clinic.id ? "…" : "Check-in"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              <Button
                className="w-full"
                disabled={!allChecked}
                onClick={handleCompleteRoute}
              >
                {allChecked ? "✓ Complete Route" : `${visits.length}/${route.clinics.length} Clinics Visited`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MRDashboard;
