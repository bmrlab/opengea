// executeJavaScript runs this file as an async function body, with tools and input.
const selected = input?.regions ?? ["north", "south"];
if (
  !Array.isArray(selected) ||
  selected.length === 0 ||
  selected.some((region) => region !== "north" && region !== "south") ||
  new Set(selected).size !== selected.length
) {
  throw new Error(
    "regions must contain north, south, or both without duplicates",
  );
}
const [listing, policy] = await Promise.all([
  tools.orders__list_order_pages({}),
  tools.getDiscountPolicy({}),
]);
if (listing.isError) throw new Error(JSON.stringify(listing));
const pages = listing.structuredContent.pages;
const regions = Object.fromEntries(
  selected.map((region) => [
    region,
    {
      paidOrders: 0,
      units: 0,
      grossCents: 0,
      netCents: 0,
    },
  ]),
);
for (const region of selected) {
  if (
    !Number.isInteger(policy[region]) ||
    policy[region] < 0 ||
    policy[region] > 10000
  ) {
    throw new Error(`Invalid discount policy for ${region}`);
  }
}
// Bound outstanding callbacks even if this service later returns more pages.
for (let offset = 0; offset < pages.length; offset += 4) {
  const results = await Promise.all(
    pages
      .slice(offset, offset + 4)
      .map((page) => tools.orders__read_order_page({ page })),
  );
  for (const result of results) {
    if (result.isError) throw new Error(JSON.stringify(result));
    for (const order of result.structuredContent.orders) {
      if (order.status !== "paid" || !selected.includes(order.region)) continue;
      const row = regions[order.region];
      const gross = order.units * order.unitPriceCents;
      row.paidOrders++;
      row.units += order.units;
      row.grossCents += gross;
      row.netCents += Math.floor(
        (gross * (10000 - policy[order.region])) / 10000,
      );
    }
  }
}
const totals = { paidOrders: 0, units: 0, grossCents: 0, netCents: 0 };
for (const region of Object.values(regions)) {
  for (const key of Object.keys(totals)) totals[key] += region[key];
}
return { regions, totals };
