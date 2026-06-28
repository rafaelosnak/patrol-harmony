import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/use-device";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwaButton() {
  const device = useDevice();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || device.isStandalone || device.isDesktop) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") toast.success("App instalado!");
      setDeferred(null);
      setDismissed(true);
    } else if (device.os === "ios") {
      toast.info("Para instalar: toque em Compartilhar e depois em 'Adicionar à Tela de Início'.", { duration: 6000 });
    } else {
      toast.info("Use o menu do navegador e escolha 'Instalar app' ou 'Adicionar à tela inicial'.", { duration: 6000 });
    }
  };

  return (
    <Button onClick={install} size="sm" variant="outline" className="gap-2">
      {device.os === "ios" ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      Instalar app
    </Button>
  );
}
