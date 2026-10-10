// COmponente por el momento estético, añadir funcionalidad con la base de datos

export default function LevelProgressBar() {
    return (
        <div className="flex items-center gap-2 w-full">
        <div className="bg-sunday-church text-night-sky font-bold rounded-md px-2 py-1 transform rotate-45">
            <span className="inline-block transform -rotate-45">10</span>
        </div>
        <div className="h-4 bg-volcano-snow rounded-full w-full overflow-hidden">
            <div className="h-full bg-tourist-flower w-1/3"></div>
        </div>
        </div>
    );
}