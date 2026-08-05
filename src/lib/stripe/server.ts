import "server-only";

import Stripe from "stripe";

import { serverEnv } from "@/env/server";
import {
  isStripeTestSecretKey,
  stripeApiVersion,
} from "@/lib/stripe/stripe-rules";

let stripeClient: Stripe | undefined;

export function getStripeClient() {
  const secretKey = serverEnv.STRIPE_SECRET_KEY;
  if (
    serverEnv.STRIPE_CHECKOUT_MODE !== "test" ||
    !secretKey ||
    !isStripeTestSecretKey(secretKey)
  ) {
    throw new Error("Stripe Checkout test configuration is unavailable.");
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: stripeApiVersion,
    maxNetworkRetries: 2,
    typescript: true,
  });
  return stripeClient;
}
