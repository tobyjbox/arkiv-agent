import { attempt, createArkivClient } from "@arkiv-agent/core";

// Scaffold page (T01): proves the app reads Arkiv through @arkiv-agent/core. UI lands in T04.
export const dynamic = "force-dynamic";

export default async function Home() {
  const count = await attempt(() => createArkivClient().getEntityCount());
  return (
    <main>
      <h1>ArkivAgent</h1>
      <p>{count.ok ? `${count.value.toLocaleString("en")} live entities on Tiramisu` : "Tiramisu unreachable"}</p>
    </main>
  );
}
