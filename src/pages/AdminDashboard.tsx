import { useEffect, useState, useRef, useCallback } from "react";
import { onSnapshot, collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registerMR } from "@/lib/firebaseAuth";
import { useAuth } from "@/contexts/AuthContext";
import { logoutUser } from "@/lib/firebaseAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Users, Route, History, LogOut } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MRLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: number;
}

interface MRUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

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

const createMotorcycleIcon = () =>
  L.divIcon({
    html: `<div style="background:hsl(210 80% 45%);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V5l4 6h5"/><path d="M3 17h2"/></svg>
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

/* ─── Live Map Tab ─── */
const LiveMapTab = () => {
  const [locations, setLocations] = useState<MRLocation[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "locations"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MRLocation)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const icon = createMotorcycleIcon();
    const currentIds = new Set(locations.map((l) => l.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });
    locations.forEach((loc) => {
      const popup = `<b>${loc.name || loc.id}</b><br/>Last: ${loc.timestamp ? new Date(loc.timestamp).toLocaleString() : "N/A"}`;
      const existing = markersRef.current.get(loc.id);
      if (existing) { existing.setLatLng([loc.lat, loc.lng]); existing.setPopupContent(popup); }
      else {
        const m = L.marker([loc.lat, loc.lng], { icon }).addTo(map).bindPopup(popup);
        markersRef.current.set(loc.id, m);
      }
    });
  }, [locations]);

  return (
    <div className="relative h-[calc(100vh-10rem)]">
      <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur rounded-lg px-3 py-2 shadow-lg text-sm font-medium">
        {locations.length} MR{locations.length !== 1 ? "s" : ""} Online
      </div>
      <div ref={mapContainerRef} className="h-full w-full rounded-lg shadow-md" />
    </div>
  );
};

/* ─── Employees Tab ─── */
const EmployeesTab = () => {
  const [mrs, setMrs] = useState<MRUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users"), where("role", "==", "mr")),
      (snap) => setMrs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MRUser)))
    );
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!email || !password || !name) { toast.error("Fill all fields"); return; }
    setCreating(true);
    try {
      await registerMR(email, password, name);
      toast.success(`MR "${name}" created successfully`);
      setEmail(""); setName(""); setPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to create MR");
    }
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Create MR Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button onClick={handleCreate} disabled={creating} className="w-full gap-1">
            <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create MR"}
          </Button>
        </CardContent>
      </Card>
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">MR List ({mrs.length})</CardTitle></CardHeader>
        <CardContent>
          {mrs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MRs yet</p>
          ) : (
            <div className="space-y-2">
              {mrs.map((mr) => (
                <div key={mr.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{mr.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{mr.email}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded shrink-0 ml-2">{mr.id.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Route Builder Tab ─── */
const RouteBuilderTab = () => {
  const [mrs, setMrs] = useState<MRUser[]>([]);
  const [selectedMr, setSelectedMr] = useState("");
  const [clinics, setClinics] = useState<{ name: string; lat: string; lng: string }[]>([
    { name: "", lat: "", lng: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [routes, setRoutes] = useState<RouteDoc[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "users"), where("role", "==", "mr")), (s) =>
      setMrs(s.docs.map((d) => ({ id: d.id, ...d.data() } as MRUser)))
    );
    const unsub2 = onSnapshot(collection(db, "routes"), (s) =>
      setRoutes(s.docs.map((d) => ({ id: d.id, ...d.data() } as RouteDoc)))
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  const addClinic = () => setClinics([...clinics, { name: "", lat: "", lng: "" }]);
  const removeClinic = (i: number) => setClinics(clinics.filter((_, idx) => idx !== i));
  const updateClinic = (i: number, field: string, val: string) => {
    const c = [...clinics];
    (c[i] as any)[field] = val;
    setClinics(c);
  };

  const handleSave = async () => {
    if (!selectedMr) { toast.error("Select an MR"); return; }
    const valid = clinics.every((c) => c.name && c.lat && c.lng);
    if (!valid) { toast.error("Fill all clinic fields"); return; }
    setSaving(true);
    const mr = mrs.find((m) => m.id === selectedMr)!;
    try {
      await addDoc(collection(db, "routes"), {
        mrId: selectedMr,
        mrName: mr.name,
        status: "assigned",
        createdAt: Date.now(),
        clinics: clinics.map((c, i) => ({
          id: `clinic-${Date.now()}-${i}`,
          name: c.name,
          lat: parseFloat(c.lat),
          lng: parseFloat(c.lng),
          order: i,
        })),
      });
      toast.success("Route assigned successfully!");
      setClinics([{ name: "", lat: "", lng: "" }]);
      setSelectedMr("");
    } catch (e: any) {
      toast.error(e.message || "Failed to save route");
    }
    setSaving(false);
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await deleteDoc(doc(db, "routes", routeId));
      toast.success("Route deleted");
    } catch {
      toast.error("Failed to delete route");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Create Route</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={selectedMr}
            onChange={(e) => setSelectedMr(e.target.value)}
          >
            <option value="">Select MR</option>
            {mrs.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <div className="space-y-2">
            {clinics.map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input placeholder="Clinic name" value={c.name} onChange={(e) => updateClinic(i, "name", e.target.value)} />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input placeholder="Latitude" value={c.lat} onChange={(e) => updateClinic(i, "lat", e.target.value)} />
                    <Input placeholder="Longitude" value={c.lng} onChange={(e) => updateClinic(i, "lng", e.target.value)} />
                  </div>
                </div>
                {clinics.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeClinic(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={addClinic} className="w-full gap-1">
            <Plus className="h-4 w-4" /> Add Clinic
          </Button>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Assign Route"}
          </Button>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Active Routes ({routes.length})</CardTitle></CardHeader>
        <CardContent>
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No routes yet</p>
          ) : (
            <div className="space-y-2">
              {routes.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.mrName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.clinics?.length || 0} clinics · <span className={r.status === "completed" ? "text-green-600" : "text-primary"}>{r.status}</span>
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleDeleteRoute(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Route History Tab ─── */
const RouteHistoryTab = () => {
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteDoc | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const clinicMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "routes"), where("status", "==", "completed")),
      (s) => setRoutes(s.docs.map((d) => ({ id: d.id, ...d.data() } as RouteDoc)))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OSM',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const loadHistory = useCallback(async (route: RouteDoc) => {
    setSelectedRoute(route);
    const map = mapRef.current;
    if (!map) return;

    polylineRef.current?.remove();
    clinicMarkersRef.current.forEach((m) => m.remove());
    clinicMarkersRef.current = [];

    const clinicIcon = L.divIcon({
      html: `<div style="background:hsl(0 84.2% 60.2%);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg></div>`,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    route.clinics?.forEach((c) => {
      const m = L.marker([c.lat, c.lng], { icon: clinicIcon }).addTo(map).bindPopup(c.name);
      clinicMarkersRef.current.push(m);
    });

    const histSnap = await getDocs(
      query(collection(db, "history", route.mrId, "points"), orderBy("timestamp"))
    );
    const points: [number, number][] = histSnap.docs.map((d) => {
      const data = d.data();
      return [data.lat, data.lng];
    });

    if (points.length > 0) {
      const pl = L.polyline(points, { color: "#22c55e", weight: 5, opacity: 0.9 }).addTo(map);
      polylineRef.current = pl;
      map.fitBounds(pl.getBounds().pad(0.2));
    } else if (route.clinics?.length) {
      const bounds = L.latLngBounds(route.clinics.map((c) => [c.lat, c.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.2));
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card className="card-elevated">
        <CardHeader><CardTitle className="text-base">Completed Routes</CardTitle></CardHeader>
        <CardContent>
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed routes yet</p>
          ) : (
            <div className="space-y-2">
              {routes.map((r) => (
                <Button
                  key={r.id}
                  variant={selectedRoute?.id === r.id ? "default" : "outline"}
                  className="w-full justify-start gap-2"
                  onClick={() => loadHistory(r)}
                >
                  <History className="h-4 w-4" />
                  {r.mrName} — {r.clinics?.length || 0} clinics
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="h-[calc(100vh-20rem)]">
        <div ref={mapContainerRef} className="h-full w-full rounded-lg shadow-md" />
      </div>
    </div>
  );
};

/* ─── Admin Dashboard ─── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Pharma Field Force Tracker</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </header>
      <div className="p-4">
        <Tabs defaultValue="map">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="map" className="gap-1 text-xs sm:text-sm">
              <MapPin className="h-4 w-4" /> Map
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-1 text-xs sm:text-sm">
              <Users className="h-4 w-4" /> Employees
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-1 text-xs sm:text-sm">
              <Route className="h-4 w-4" /> Routes
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 text-xs sm:text-sm">
              <History className="h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="map"><LiveMapTab /></TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
          <TabsContent value="routes"><RouteBuilderTab /></TabsContent>
          <TabsContent value="history"><RouteHistoryTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
