"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import LogoViaAtlixco from "@/app/(icon)/icon.png";
import MapLoading from "@/components/map/MapLoading";

const MapViewer = dynamic(() => import("@/components/map/MapViewer"), { 
  ssr: false, 
  loading: () => <MapLoading /> 
});

export default function Home() {
  return (
    <main className="flex flex-col h-screen w-full bg-background">
      <header className="bg-night-sky text-volcano-snow p-4 shrink-0 flex items-center justify-center">
        <Image src={LogoViaAtlixco} alt="Vía Atlixco Logo" width={32} height={32} className="h-8 w-8 mr-2" />
        <h1 className="text-xl font-bold">Vía Atlixco</h1>
      </header>
      
      <section className="flex-1 relative w-full overflow-hidden z-0">
        <div className="absolute top-7 left-4 z-10">
          {/* Diseño provisional de cómo se va a ver la GUI, 
          conforme se añadan los componentes finales funcionales, 
          se eliminarán estas representaciones estáticas del código*/}
          <button className="bg-night-sky text-volcano-snow p-2 rounded-md shadow-md">
            Menú
          </button>
        </div>
        
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-sunday-church text-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-md">
            U
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-10 bg-background/80 p-3 rounded-md shadow-md backdrop-blur-sm">
          <p className="text-sm font-semibold mb-2 bg-night-sky text-volcano-snow px-2 py-1 rounded">Filtro</p>
          <div className="flex items-center gap-2 text-sm">
            <input id="cierres-bloqueos" type="checkbox" className="appearance-none w-4 h-4 rounded-full bg-volcano-snow checked:bg-sunday-church cursor-pointer" />
            <label htmlFor="cierres-bloqueos" className="cursor-pointer">Cierres o bloqueos</label>
          </div>
          <div className="flex items-center gap-2 text-sm mt-1">
            <input id="transporte-publico" type="checkbox" className="appearance-none w-4 h-4 rounded-full bg-volcano-snow checked:bg-sunday-church cursor-pointer" />
            <label htmlFor="transporte-publico" className="cursor-pointer">Transporte público</label>
          </div>
        </div>

        {/* El componente del mapa hereda el alto del contenedor 'flex-1' */}
        <MapViewer />
      </section>

      <footer className="bg-night-sky text-volcano-snow p-4 shrink-0 flex flex-wrap-reverse items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-1/2">
          <div className="bg-sunday-church text-night-sky font-bold rounded-md px-2 py-1 transform rotate-45">
            <span className="inline-block transform -rotate-45">10</span>
          </div>
          <div className="h-4 bg-volcano-snow rounded-full w-full overflow-hidden">
            <div className="h-full bg-tourist-flower w-1/3"></div>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-between md:justify-end">
          <button className="bg-volcano-snow text-night-sky px-4 py-2 rounded-md font-semibold cursor-pointer">
            Tus reportes
          </button>
          <button className="bg-enphasis-red text-volcano-snow px-4 py-2 rounded-md font-semibold cursor-pointer">
            Reportar
          </button>
        </div>
        
      </footer>
    </main>
  );
}
