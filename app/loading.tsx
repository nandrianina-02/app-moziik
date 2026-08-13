import { EqualizerLoader } from "@/components/ui/EqualizerLoader";

export default function Loading() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <EqualizerLoader />
    </div>
  );
}
