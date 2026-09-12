# Add-on marketplace

The catalogue and each `/app/addons/<product>/` page use sample offers. Product previews illustrate the intended workflow; demo activation stays in local browser storage and does not grant a paid entitlement.

## Connect Stripe

Each offer in `app/lib/addons.js` supports a Stripe-hosted Payment Link. Before enabling an offer:

1. Approve the USD monthly price, included allowance, recurring terms and product availability.
2. Create the corresponding recurring product and Payment Link in Stripe. Start in Stripe test mode.
3. Set `paymentLink` to its `https://buy.stripe.com/...` URL and `samplePricing` to false. Ensure the visible offer matches Stripe exactly. No API key belongs in frontend code.
4. Test successful, cancelled and failed checkout in Stripe test mode. The application does not infer payment success from a redirect or local storage.

Live subscriptions additionally require authenticated workspace ownership and server-side fulfilment from verified Stripe webhooks, including cancellation and failed-renewal handling. These services are not present in this demo. Do not enable live collection until they exist. A demo enable/remove button never modifies a Stripe subscription.

Stripe references: https://docs.stripe.com/payment-links and https://docs.stripe.com/checkout/fulfillment
