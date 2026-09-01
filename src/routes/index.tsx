import { createFileRoute } from "@tanstack/react-router";
import { EchoesApp } from "@/components/echoes-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <EchoesApp />;
}
