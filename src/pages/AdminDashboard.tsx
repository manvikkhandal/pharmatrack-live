import { useEffect, useState, useRef, useCallback } from "react";
import { onSnapshot, collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registerMR } from "@/lib/firebaseAuth";
import { useAuth } from "@/contexts/AuthContext";
import { logoutUser } from "@/lib/firebaseAuth";
import { searchAddress, reverseGeocode, NominatimResult } from "@/lib/nominatim";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Users, Route, History, LogOut, Search, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MRLocation { id: string; name: string; lat: number; lng: number; timestamp: number; }
interface MRUser { id: string; email: string; name: string; role: string; }
interface Clinic { id: string; name: string; lat: number; lng: number; order: number; }
interface RouteDoc { id: string; mrId: string; mrName: string; status: string; createdAt: number; clinics: Clinic[]; }

const createMotorcycleIcon = () =>
  L.divIcon({
    html: `<div style="background:hsl(173 80% 40%);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">
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
    <div className="relative h-[calc(100vh-12rem)]">
      <div className="absolute top-3 right-3 z-[1000] card-glass-sm px-4 py-2 text-sm font-semibold">
        {locations.length} MR{locations.length !== 1 ? "s" : ""} Online
      </div>
      <div ref={mapContainerRef} className="h-full w-full rounded-2xl overflow-hidden shadow-lg" />
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
      <div className="card-glass p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Create MR Account</h3>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border/40 rounded-xl h-11" />
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50 border-border/40 rounded-xl h-11" />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary/50 border-border/40 rounded-xl h-11" />
        <Button onClick={handleCreate} disabled={creating} className="w-full btn-glow rounded-xl h-11 gap-2">
          <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create MR"}
        </Button>
      </div>

      <div className="card-glass p-6 space-y-3">
        <h3 className="font-semibold">MR List ({mrs.length})</h3>
        {mrs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No MRs yet</p>
        ) : (
          <div className="space-y-2">
            {mrs.map((mr) => (
              <div key={mr.id} className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border/30 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{mr.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{mr.email}</p>
                </div>
                <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-lg font-medium shrink-0 ml-2">{mr.id.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Address Search Component ─── */
const AddressSearch = ({ onSelect }: { onSelect: (name: string, lat: number, lng: number) => void }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await searchAddress(val);
      setResults(res);
      setSearching(false);
    }, 400);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clinic address (e.g. MI Road, Jaipur)"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 bg-secondary/50 border-border/40 rounded-xl h-11"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
      </div>
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl bg-card border border-border/40 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 transition-colors border-b border-border/20 last:border-0"
              onClick={() => {
                onSelect(r.display_name.split(",")[0], parseFloat(r.lat), parseFloat(r.lon));
                setQuery("");
                setResults([]);
              }}
            >
              <p className="font-medium truncate">{r.display_name.split(",")[0]}</p>
              <p className="text-xs text-muted-foreground truncate">{r.display_name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Route Builder Tab ─── */
const RouteBuilderTab = () => {
  const [mrs, setMrs] = useState<MRUser[]>([]);
  const [selectedMr, setSelectedMr] = useState("");
  const [clinics, setClinics] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const clinicMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "users"), where("role", "==", "mr")), (s) =>
      setMrs(s.docs.map((d) => ({ id: d.id, ...d.data() } as MRUser)))
    );
    const unsub2 = onSnapshot(collection(db, "routes"), (s) =>
      setRoutes(s.docs.map((d) => ({ id: d.id, ...d.data() } as RouteDoc)))
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OSM',
    }).addTo(map);

    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const name = await reverseGeocode(lat, lng);
      setClinics((prev) => [...prev, { name: name.split(",")[0], lat, lng }]);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Sync markers with clinics
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clinicMarkersRef.current.forEach((m) => m.remove());
    clinicMarkersRef.current = [];

    const clinicIcon = L.divIcon({
      html: `<div style="background:hsl(173 80% 40%);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);color:white;font-weight:700;font-size:12px"></div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    clinics.forEach((c, i) => {
      const icon = L.divIcon({
        html: `<div style="background:hsl(173 80% 40%);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);color:white;font-weight:700;font-size:12px">${i + 1}</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const m = L.marker([c.lat, c.lng], { icon }).addTo(map).bindPopup(c.name);
      clinicMarkersRef.current.push(m);
    });
  }, [clinics]);

  const addClinicFromSearch = (name: string, lat: number, lng: number) => {
    setClinics((prev) => [...prev, { name, lat, lng }]);
    mapRef.current?.setView([lat, lng], 14);
  };

  const removeClinic = (i: number) => setClinics(clinics.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!selectedMr) { toast.error("Select an MR"); return; }
    if (clinics.length === 0) { toast.error("Add at least one clinic"); return; }
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
          lat: c.lat,
          lng: c.lng,
          order: i,
        })),
      });
      toast.success("Route assigned successfully!");
      setClinics([]);
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
      <div className="card-glass p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Route className="h-4 w-4 text-primary" /> Create Route</h3>

        <select
          className="flex h-11 w-full rounded-xl border border-border/40 bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={selectedMr}
          onChange={(e) => setSelectedMr(e.target.value)}
        >
          <option value="">Select MR</option>
          {mrs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <AddressSearch onSelect={addClinicFromSearch} />

        <p className="text-xs text-muted-foreground">Or click on the map below to add a checkpoint</p>

        <div ref={mapContainerRef} className="h-48 sm:h-64 w-full rounded-xl overflow-hidden border border-border/30" />

        {clinics.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Clinics ({clinics.length})</p>
            {clinics.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/40 border border-border/30 p-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</p>
                </div>
                <button onClick={() => removeClinic(i)} className="text-destructive hover:text-destructive/80 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full btn-glow rounded-xl h-11">
          {saving ? "Saving…" : "Assign Route"}
        </Button>
      </div>

      <div className="card-glass p-6 space-y-3">
        <h3 className="font-semibold">Active Routes ({routes.length})</h3>
        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No routes yet</p>
        ) : (
          <div className="space-y-2">
            {routes.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border/30 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.mrName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.clinics?.length || 0} clinics · <span className={r.status === "completed" ? "text-emerald-400" : "text-primary"}>{r.status}</span>
                  </p>
                </div>
                <button onClick={() => handleDeleteRoute(r.id)} className="text-destructive hover:text-destructive/80 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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
      html: `<div style="background:hsl(0 84% 60%);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg></div>`,
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
      <div className="card-glass p-6 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Completed Routes</h3>
        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No completed routes yet</p>
        ) : (
          <div className="space-y-2">
            {routes.map((r) => (
              <button
                key={r.id}
                className={`w-full text-left rounded-xl border p-3 transition-all ${selectedRoute?.id === r.id ? "bg-primary/15 border-primary/40" : "bg-secondary/40 border-border/30 hover:bg-secondary/60"}`}
                onClick={() => loadHistory(r)}
              >
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{r.mrName} — {r.clinics?.length || 0} clinics</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-[calc(100vh-22rem)]">
        <div ref={mapContainerRef} className="h-full w-full rounded-2xl overflow-hidden shadow-lg" />
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
    <div className="min-h-screen">
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-border/30">
        <div>
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <p className="text-xs text-muted-foreground">Pharma Field Force Tracker</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Tabs defaultValue="map">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-card/40 backdrop-blur rounded-xl p-1 h-auto gap-1">
            <TabsTrigger value="map" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5">
              <MapPin className="h-4 w-4" /> Map
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5">
              <Users className="h-4 w-4" /> Employees
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5">
              <Route className="h-4 w-4" /> Routes
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5">
              <History className="h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="map"><LiveMapTab /></TabsContent>
            <TabsContent value="employees"><EmployeesTab /></TabsContent>
            <TabsContent value="routes"><RouteBuilderTab /></TabsContent>
            <TabsContent value="history"><RouteHistoryTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
