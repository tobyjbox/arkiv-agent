import { getDecode } from "@arkiv-agent/decode";
import { DecodeView } from "../../components/decode/decode-view";
import { RefreshOnChange } from "../../components/pulse/refresh";
import { ResultsPending } from "../../components/ui/results-pending";
import { isIndexReady } from "../../lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arkiv-Decode · ArkivAgent" };

export default function DecodePage() {
  if (!isIndexReady()) return null;
  const decode = getDecode();
  if (!decode) return <ResultsPending title="Arkiv-Decode" />;
  return (
    <>
      <RefreshOnChange />
      <DecodeView decode={decode} />
    </>
  );
}
