import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Trash2, Image, Video, Loader2 } from "lucide-react";

interface MediaItem {
  id: string;
  file_path: string;
  file_url: string;
  file_type: string;
  media_category: string;
  reference_key: string | null;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const menuItemNames = [
  "MARINARA", "MARGHERITA", "SICILIANA", "FUNGHI", "GRECA", "TEDESCA", "PICCANTE",
  "TARRAGONINA", "PROSCIUTTO", "RÚSTICA", "CALABRESE", "TONNARA", "CATALANA",
  "VEGETARIANA", "4 STAGIONI", "ITALIANA", "CIOCIARA", "FANTASÍA", "MILANO",
  "BOSCAIOLA", "SPECK", "TROPEA", "HAWAI", "BRESAOLINA", "4 FORMAGGI",
  "NORVEGIA", "SALENTINA", "LOMBARDA",
  "FOCACCIA CRUDO", "FOCACCIA CAPRESE", "LA FOCACCIA DELLO ZIO",
  "CALZONE", "BIG CALZONE", "RUSTICELLA (Calzone)",
];

const locationSlugs = [
  { slug: "tarragona", label: "Lo Zio Tarragona" },
  { slug: "arrabassada", label: "Lo Zio Arrabassada" },
  { slug: "rincon", label: "El Rincón de Lo Zio" },
];

const AdminMedia = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("menu_item");
  const [selectedRef, setSelectedRef] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    const { data, error } = await supabase
      .from("media")
      .select("*")
      .order("media_category")
      .order("reference_key")
      .order("sort_order");
    if (error) {
      toast.error("Error cargando media");
      return;
    }
    setMedia((data as MediaItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const refKey = selectedRef || undefined;

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const folder = activeTab === "menu_item" ? "menu" : activeTab === "location" ? "locations" : "videos";
      const fileName = `${folder}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, file, { cacheControl: "31536000", upsert: false });

      if (uploadError) {
        toast.error(`Error subiendo ${file.name}: ${uploadError.message}`);
        continue;
      }

      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${fileName}`;

      const { error: insertError } = await supabase.from("media").insert({
        file_path: fileName,
        file_url: fileUrl,
        file_type: isVideo ? "video" : "image",
        media_category: activeTab,
        reference_key: refKey || null,
        alt_text: activeTab === "menu_item" ? `Pizza artesanal ${refKey} Lo Zio Tarragona` : null,
      });

      if (insertError) {
        toast.error(`Error guardando ${file.name}`);
        continue;
      }

      toast.success(`${file.name} subido correctamente`);
    }

    setUploading(false);
    fetchMedia();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (item: MediaItem) => {
    const { error: storageError } = await supabase.storage.from("media").remove([item.file_path]);
    if (storageError) {
      toast.error("Error eliminando archivo");
      return;
    }
    const { error: dbError } = await supabase.from("media").delete().eq("id", item.id);
    if (dbError) {
      toast.error("Error eliminando registro");
      return;
    }
    toast.success("Archivo eliminado");
    fetchMedia();
  };

  const filteredMedia = media.filter((m) => m.media_category === activeTab);

  const renderRefSelector = () => {
    if (activeTab === "menu_item") {
      return (
        <select
          value={selectedRef}
          onChange={(e) => setSelectedRef(e.target.value)}
          className="w-full md:w-auto px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body text-sm"
        >
          <option value="">— Selecciona plato —</option>
          {menuItemNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      );
    }
    if (activeTab === "location") {
      return (
        <select
          value={selectedRef}
          onChange={(e) => setSelectedRef(e.target.value)}
          className="w-full md:w-auto px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body text-sm"
        >
          <option value="">— Selecciona local —</option>
          {locationSlugs.map((loc) => (
            <option key={loc.slug} value={loc.slug}>{loc.label}</option>
          ))}
        </select>
      );
    }
    return null;
  };

  const renderMediaGrid = () => {
    if (loading) return <p className="text-muted-foreground font-body text-center py-8">Cargando...</p>;
    if (!filteredMedia.length) return <p className="text-muted-foreground font-body text-center py-8">No hay archivos en esta categoría</p>;

    // Group by reference_key
    const grouped: Record<string, MediaItem[]> = {};
    filteredMedia.forEach((m) => {
      const key = m.reference_key || "Sin asignar";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([key, items]) => (
          <div key={key}>
            <h4 className="font-display font-bold text-foreground text-sm mb-3 uppercase tracking-wider">{key}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map((item) => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border border-border bg-card">
                  {item.file_type === "video" ? (
                    <video
                      src={item.file_url}
                      className="w-full aspect-square object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                    />
                  ) : (
                    <img src={item.file_url} alt={item.alt_text || ""} className="w-full aspect-square object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(item)}
                      className="text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                  <div className="absolute top-1 left-1">
                    {item.file_type === "video" ? (
                      <Video className="w-4 h-4 text-white drop-shadow-lg" />
                    ) : (
                      <Image className="w-4 h-4 text-white drop-shadow-lg" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedRef(""); }}>
        <TabsList className="bg-muted">
          <TabsTrigger value="menu_item" className="font-body text-xs">🍕 Menú</TabsTrigger>
          <TabsTrigger value="location" className="font-body text-xs">📍 Locales</TabsTrigger>
          <TabsTrigger value="background_video" className="font-body text-xs">🎬 Vídeos fondo</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {renderRefSelector()}

          <input
            ref={fileInputRef}
            type="file"
            accept={activeTab === "background_video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp,video/mp4,video/webm"}
            multiple
            onChange={handleUpload}
            className="hidden"
            id="media-upload"
          />
          <Button
            onClick={() => {
              if (activeTab !== "background_video" && !selectedRef) {
                toast.error("Selecciona primero un plato o local");
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="font-body font-bold text-xs uppercase"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Subir archivos</>
            )}
          </Button>
        </div>

        <TabsContent value="menu_item" className="mt-4">{renderMediaGrid()}</TabsContent>
        <TabsContent value="location" className="mt-4">{renderMediaGrid()}</TabsContent>
        <TabsContent value="background_video" className="mt-4">{renderMediaGrid()}</TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMedia;
