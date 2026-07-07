import { toast } from "sonner";
import { Toaster } from "sonner";

export function AppToaster() {
  return <Toaster position="top-right" richColors />;
}

export { toast };
