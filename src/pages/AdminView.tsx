import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { onSnapshot, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const motorcycleIcon = new L.DivIcon({
  html: `<div style="background:#1d6fb8;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V5l4 6h5"/><path d="M3 17h2"/></svg>
  </div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface MRLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: number;
}

const AdminView = () => {
  const [locations, setLocations] = useState<MRLocation[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "locations"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MRLocation[];
      setLocations(data);
    });
    return () => unsub();
  }, []);

  return (
    <div className="h-screen w-screen relative">
      <div className="absolute top-4 left-4 z-[1000]">
        <Button variant="secondary" size="sm" className="gap-1 shadow-lg" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
      <div className="absolute top-4 right-4 z-[1000] bg-background/90 backdrop-blur rounded-lg px-3 py-2 shadow-lg text-sm font-medium">
        {locations.length} MR{locations.length !== 1 ? "s" : ""} Online
      </div>
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        className="h-full w-full"
        style={{ zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={motorcycleIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{loc.name || loc.id}</p>
                <p className="text-muted-foreground">
                  Last seen: {loc.timestamp ? new Date(loc.timestamp).toLocaleString() : "N/A"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default AdminView;
