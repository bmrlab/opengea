import { createFileRoute } from "@tanstack/react-router";
import { OAuthApp } from "./-oauth-app";
export const Route = createFileRoute("/")({ component: OAuthApp });
