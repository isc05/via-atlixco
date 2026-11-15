"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import LogoViaAtlixco from "@/app/(icon)/icon.png";
import ActionButton from "@/components/ui/ActionButton";
import LevelProgressBar from "@/components/gamification/LevelProgressBar";
import MapLoading from "@/components/map/MapLoading";
import { Show, SignInButton, UserButton } from '@clerk/nextjs';

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
        <div className="absolute top-25 left-4 z-10">
          {/* Diseño provisional de cómo se va a ver la GUI, 
          conforme se añadan los componentes finales funcionales, 
          se eliminarán estas representaciones estáticas del código*/}
          <button className="flex bg-night-sky text-volcano-snow p-2 rounded-md shadow-md cursor-pointer">
            <span className="material-icons-round text-3xl leading-none">menu</span>
          </button>
        </div>
        
        <div className="absolute top-4 right-4 z-10 cursor-pointer">
          <Show when="signed-out">
            <SignInButton mode="modal">
                <button className="bg-sunday-church text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
                  U
                </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: {
                    width: "50px",
                    height: "50px"
                  }
                },
              }}
            />
          </Show>
        </div>

        <div className="absolute bottom-4 left-4 z-10 bg-background/80 p-3 rounded-md shadow-md backdrop-blur-sm">
          <p className="text-sm font-semibold mb-2 bg-night-sky text-volcano-snow px-2 py-1 rounded">Filtro</p>
          <div className="flex items-center gap-2 text-sm mt-1">
            <input id="transporte-publico" type="checkbox" className="appearance-none w-4 h-4 rounded-full bg-volcano-snow checked:bg-sunday-church cursor-pointer" />
            <label htmlFor="transporte-publico" className="cursor-pointer">Transporte público</label>
          </div>
        </div>

        {/* El componente del mapa hereda el alto del contenedor 'flex-1' */}
        <MapViewer />
      </section>

      <footer className="bg-night-sky text-volcano-snow p-6 shrink-0 flex flex-wrap-reverse items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-1/2">
          <LevelProgressBar/>
        </div>

        <div className="flex gap-4 w-full md:w-auto justify-between md:justify-end">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <ActionButton className="bg-volcano-snow text-night-sky">
              Tus reportes
              </ActionButton>
            </SignInButton>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">  
              <ActionButton className="bg-enphasis-red text-volcano-snow">
              Reportar
              </ActionButton>
            </SignInButton>
          </Show>

          <Show when="signed-in">
            <ActionButton className="bg-volcano-snow text-night-sky">
              Tus reportes
            </ActionButton>
          </Show>
          <Show when="signed-in">
            <ActionButton className="bg-enphasis-red text-volcano-snow">
              Reportar
            </ActionButton>
          </Show>
        </div>
        
      </footer>
    </main>
  );
}
