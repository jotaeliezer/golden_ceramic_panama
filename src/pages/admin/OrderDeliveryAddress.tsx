import { readStoredDeliveryAddress } from "../../delivery-address";

export function OrderDeliveryAddress({
  shippingAddress,
  deliveryAddress,
}: {
  shippingAddress?: string | null;
  deliveryAddress?: unknown;
}) {
  const delivery = readStoredDeliveryAddress(deliveryAddress);
  if (!delivery) {
    const legacy = shippingAddress?.trim();
    if (!legacy) {
      return <p className="text-xs text-gray-500 dark:text-neutral-400">No delivery address on file.</p>;
    }
    return <p className="whitespace-pre-line text-xs text-gray-600 break-words dark:text-neutral-300">{legacy}</p>;
  }

  const rows: [string, string][] = [
    ["Name", delivery.name],
    ["Street", delivery.street],
    ["Corregimiento", delivery.corregimiento],
    ["City", delivery.city],
    ["Province", delivery.province],
    ["Country", "Panama"],
  ];
  if (delivery.notes) rows.push(["Notes", delivery.notes]);

  return (
    <dl className="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-neutral-300">
      {rows.map(([label, value]) => (
        <div key={label} className="break-words">
          <dt className="inline font-medium text-gray-500 dark:text-neutral-400">{label}: </dt>
          <dd className="inline">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
