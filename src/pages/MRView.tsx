import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MapPin, Navigation, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const MR_ID = "mr-" + Math.random().toString(36).slice(2, 8);
const MR_NAME = "MR " + MR_ID.slice(3).toUpperCase();
const DUMMY_CLINIC = { lat: 19.076, lng: 72.8777, name: "Apollo Clinic, Mumbai" };

const MRView = () => {
  const [tracking, setTracking] = useState(false);
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPos = useRef<GeolocationPosition | null>(null);
  const navigate = useNavigate();

  const pushLocation = useCallback(async (pos: GeolocationPosition) => {
    const data = {
      name: MR_NAME,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: Date.now(),
    };
    setLastPos({ lat: data.lat, lng: data.lng });
    try {
      await setDoc(doc(db, "locations", MR_ID), data);
    } catch {
      toast.error("Failed to update location");
    }
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latestPos.current = pos;
        pushLocation(pos);
      },
      () => toast.error("Location access denied"),
      { enableHighAccuracy: true }
    );
    intervalRef.current = setInterval(() => {
      if (latestPos.current) pushLocation(latestPos.current);
    }, 20000);
    toast.success("GPS Tracking started");
  }, [pushLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    watchIdRef.current = null;
    intervalRef.current = null;
    toast.info("GPS Tracking stopped");
  }, []);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  const handleToggle = (on: boolean) => {
    setTracking(on);
    on ? startTracking() : stopTracking();
  };

  const openGoogleMaps = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${DUMMY_CLINIC.lat},${DUMMY_CLINIC.lng}`,
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start gap-1" onClick={() => navigate("/")}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="text-center">
        <h1 className="text-xl font-bold text-foreground">{MR_NAME}</h1>
        <p className="text-sm text-muted-foreground">Medical Representative</p>
      </div>

      <Card>
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
                {lastPos && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {lastPos.lat.toFixed(4)}, {lastPos.lng.toFixed(4)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Toggle to start sharing location</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" /> Next Visit
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{DUMMY_CLINIC.name}</p>
            <p className="text-xs text-muted-foreground">
              {DUMMY_CLINIC.lat}, {DUMMY_CLINIC.lng}
            </p>
          </div>
          <Button size="sm" onClick={openGoogleMaps} className="gap-1">
            <Navigation className="h-4 w-4" /> Navigate
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MRView;
