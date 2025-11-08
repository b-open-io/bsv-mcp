import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

const authServerUrl = process.env.OAUTH_ISSUER || "https://auth.sigmaidentity.com";

const handler = protectedResourceHandler({
  authServerUrls: [authServerUrl],
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
