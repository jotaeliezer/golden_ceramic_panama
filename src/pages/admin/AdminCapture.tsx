import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, Minus, Plus, RotateCcw } from "lucide-react";
import { compressImageToJpegDataUrl, compressVideoFrameToJpegDataUrl } from "../../lib/compressImage";
import { defaultMoldName } from "../../lib/moldName";

type Step = "camera" | "preview" | "quantity" | "done";

type SavedCapture = {
  id: string;
  name: string;
  stock: number;
  imageUrl: string;
};

const STEPS: { id: Step; label: string }[] = [
  { id: "camera", label: "Photo" },
  { id: "preview", label: "Preview" },
  { id: "quantity", label: "Quantity" },
  { id: "done", label: "Saved" },
];

function parseQuantity(value: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(value)) return null;
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) return null;
  return quantity;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    // Non-JSON error pages still need a plain message.
  }
  if (response.status === 413) return "That photo is too large. Try another one.";
  if (response.status === 401 || response.status === 403) {
    return "Your admin session expired. Log in again.";
  }
  return "Could not add this piece to the catalog.";
}

async function openCamera(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ];
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Camera unavailable");
}

export default function AdminCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("camera");
  const [photo, setPhoto] = useState("");
  const [liveReady, setLiveReady] = useState(false);
  const [cameraNote, setCameraNote] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<SavedCapture | null>(null);

  useEffect(() => {
    if (step !== "camera") return;
    const video = videoRef.current;
    let stream: MediaStream | null = null;
    let cancelled = false;

    setLiveReady(false);
    setCameraNote("");

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraNote("Live preview is not available in this browser. Take photo still opens the camera.");
        return;
      }
      try {
        stream = await openCamera();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        if (!cancelled) {
          setLiveReady(true);
          setCameraNote("");
        }
      } catch {
        if (!cancelled) {
          setLiveReady(false);
          setCameraNote(
            "Live preview needs camera permission and a secure page (HTTPS or localhost). Take photo still works on a phone."
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [step]);

  function acceptPhoto(dataUrl: string) {
    setPhoto(dataUrl);
    setError("");
    setStep("preview");
  }

  async function onFile(event: { target: HTMLInputElement }) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo of the mold.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("That photo is too large. Try another one.");
      return;
    }
    try {
      acceptPhoto(await compressImageToJpegDataUrl(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that photo. Try another image.");
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    try {
      acceptPhoto(compressVideoFrameToJpegDataUrl(video));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not take the photo.");
    }
  }

  function retake() {
    setPhoto("");
    setError("");
    setStep("camera");
    fileRef.current?.focus();
  }

  function continueToQuantity() {
    setName((current) => (current.trim() ? current : defaultMoldName()));
    setError("");
    setStep("quantity");
  }

  function changeQuantity(next: string) {
    if (next === "") {
      setQuantityInput("");
      return;
    }
    if (!/^\d+$/.test(next)) return;
    const quantity = Number(next);
    if (!Number.isSafeInteger(quantity) || quantity > 1_000_000) return;
    setQuantityInput(String(quantity));
  }

  function bump(delta: number) {
    const current = parseQuantity(quantityInput) ?? 0;
    changeQuantity(String(Math.max(0, Math.min(1_000_000, current + delta))));
  }

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    const quantity = parseQuantity(quantityInput);
    if (quantity === null) {
      setError("Enter a whole number, 0 or more.");
      return;
    }
    const trimmedName = name.trim() || defaultMoldName();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken") ?? ""}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          quantity,
          imageDataUrl: photo,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = (await response.json()) as SavedCapture;
      setSaved(data);
      setName(trimmedName);
      setStep("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this piece to the catalog.");
    } finally {
      setSubmitting(false);
    }
  }

  function captureAnother() {
    setStep("camera");
    setPhoto("");
    setName("");
    setQuantityInput("1");
    setSaved(null);
    setError("");
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Temporary · local only</p>
      <h1 className="mt-2 font-serif text-3xl text-charcoal">Capture a mold</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal-light">
        Take a photo of a ceramic or plaster mold and record how many you have. The photo and quantity are saved on
        this server until the Supabase migration. Nothing is sent to the cloud.
      </p>
      <ol className="mt-5 flex gap-2" aria-label="Capture steps">
        {STEPS.map((item, index) => (
          <li
            key={item.id}
            className={`h-1 flex-1 rounded-full ${index <= stepIndex ? "bg-gold" : "bg-charcoal/15"}`}
          >
            <span className="sr-only">
              {item.label}
              {index === stepIndex ? " (current)" : ""}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {step === "camera" && (
        <div className="mt-5 rounded-lg bg-white p-4 shadow">
          <div
            className={`relative aspect-[3/4] overflow-hidden rounded bg-ivory-focus ${
              liveReady ? "" : "border border-dashed border-charcoal/20"
            }`}
          >
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full bg-black object-cover ${liveReady ? "opacity-100" : "opacity-0"}`}
              playsInline
              muted
              autoPlay
            />
            {!liveReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                <Camera className="mb-3 h-10 w-10 text-gold" aria-hidden="true" />
                <p className="text-sm font-medium text-charcoal">Point the phone at the mold</p>
                {cameraNote && <p className="mt-2 text-xs leading-relaxed text-gray-500">{cameraNote}</p>}
              </div>
            )}
          </div>

          {liveReady && (
            <button
              type="button"
              onClick={snap}
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded bg-charcoal text-sm font-semibold tracking-wide text-white hover:bg-charcoal-light"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              Snap photo
            </button>
          )}

          <label
            className={`flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded text-sm font-semibold tracking-wide ${
              liveReady
                ? "mt-3 border border-charcoal/20 text-charcoal hover:bg-ivory-focus"
                : "mt-4 bg-charcoal text-white hover:bg-charcoal-light"
            }`}
          >
            <Camera className="h-5 w-5" aria-hidden="true" />
            Take photo
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onFile}
            />
          </label>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Take photo uses the phone camera. On this computer it opens a file picker. A live preview needs HTTPS
            when you open the site from another phone on Wi-Fi.
          </p>
        </div>
      )}

      {step === "preview" && (
        <div className="mt-5 rounded-lg bg-white p-4 shadow">
          <img src={photo} alt="Preview of the captured mold" className="aspect-[3/4] w-full rounded object-cover" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={retake}
              className="flex min-h-14 items-center justify-center gap-2 rounded border border-charcoal/20 text-sm font-semibold text-charcoal hover:bg-ivory-focus"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retake
            </button>
            <button
              type="button"
              onClick={continueToQuantity}
              className="min-h-14 rounded bg-charcoal text-sm font-semibold text-white hover:bg-charcoal-light"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "quantity" && (
        <form onSubmit={submit} className="mt-5 rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <img src={photo} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
            <button
              type="button"
              onClick={retake}
              className="flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal hover:text-gold-dark"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Retake
            </button>
          </div>

          <h2 id="quantity-question" className="mt-5 font-serif text-2xl leading-snug text-charcoal">
            How many of this piece do you have?
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => bump(-1)}
              disabled={quantityInput === "0"}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-charcoal/20 text-charcoal hover:bg-ivory-focus disabled:opacity-40"
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <input
              inputMode="numeric"
              aria-labelledby="quantity-question"
              value={quantityInput}
              onChange={(event) => changeQuantity(event.target.value)}
              className="h-14 min-w-0 flex-1 rounded border border-gray-300 text-center font-serif text-3xl text-charcoal outline-none focus:border-gold"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => bump(1)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-charcoal/20 text-charcoal hover:bg-ivory-focus"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">Whole number, 0 or more. This becomes the catalog stock.</p>

          <label className="mt-5 block text-sm font-medium text-gray-700" htmlFor="mold-name">
            Name <span className="font-normal text-gray-500">(optional)</span>
            <input
              id="mold-name"
              type="text"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 min-h-12 w-full rounded border border-gray-300 p-3 text-base text-charcoal outline-none focus:border-gold"
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">Shown in the catalog. Clear it to keep the suggested name.</p>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex min-h-14 w-full items-center justify-center rounded bg-charcoal text-sm font-semibold tracking-wide text-white hover:bg-charcoal-light disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Add to catalog"}
          </button>
        </form>
      )}

      {step === "done" && saved && (
        <div className="mt-5 rounded-lg bg-white p-6 text-center shadow">
          <Check className="mx-auto h-12 w-12 text-gold" aria-hidden="true" />
          <h2 className="mt-3 font-serif text-3xl text-charcoal">Added to catalog</h2>
          <img
            src={saved.imageUrl}
            alt={saved.name}
            className="mx-auto mt-5 aspect-[3/4] w-full max-w-xs rounded object-cover"
          />
          <p className="mt-4 text-base font-medium text-charcoal">{saved.name}</p>
          <p className="mt-1 text-sm text-gray-600">{saved.stock} in stock</p>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Price stays $0 until you set it under Products. The photo file is stored locally on this server.
          </p>
          <button
            type="button"
            onClick={captureAnother}
            className="mt-5 flex min-h-14 w-full items-center justify-center rounded bg-charcoal text-sm font-semibold tracking-wide text-white hover:bg-charcoal-light"
          >
            Capture another
          </button>
          <Link
            to="/admin/products"
            className="mt-3 flex min-h-11 items-center justify-center text-sm font-semibold text-gold-dark hover:text-gold"
          >
            View products
          </Link>
        </div>
      )}
    </div>
  );
}
