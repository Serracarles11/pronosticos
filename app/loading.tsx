import { RingLoader } from "./components/ring-loader";

export default function Loading() {
  return (
    <div className="page-loader" role="status" aria-label="Cargando">
      <RingLoader />
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
