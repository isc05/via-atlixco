import Image from "next/image";
import loading from "@/assets/animation-logo/loading.png";

export default function MapLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-volcano-snow">
      <div className="relative w-20 h-20 animate-spin">
        <Image 
          src={loading}
          alt="Cargando mapa..."
          fill
          className="object-contain"
        />
      </div>
      <p className="mt-4 text-night-sky font-semibold animate-pulse">
        Cargando...
      </p>
    </div>
  );
}