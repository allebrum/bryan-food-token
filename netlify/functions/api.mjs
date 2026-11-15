// Netlify Functions v2 entry. v2 is required for strongly consistent Blobs
// reads (Lambda-compat functions can't do them). Express still does the
// routing: the Web Request is turned into the API Gateway–style event that
// serverless-http understands, and its result back into a Response.
import serverless from 'serverless-http'
import { createApp } from '../../server/app.js'
import { blobStore } from '../../server/store.js'

let handle

export default async (req) => {
  if (!handle) handle = serverless(createApp({ store: await blobStore() }))
  const url = new URL(req.url)
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const out = await handle(
    {
      httpMethod: req.method,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      multiValueQueryStringParameters: [...url.searchParams.keys()].reduce((m, k) => ((m[k] = url.searchParams.getAll(k)), m), {}),
      headers: Object.fromEntries(req.headers),
      body: hasBody ? await req.text() : null,
      isBase64Encoded: false,
    },
    {},
  )
  const headers = new Headers()
  for (const [k, v] of Object.entries(out.headers ?? {})) headers.set(k, String(v))
  for (const [k, vs] of Object.entries(out.multiValueHeaders ?? {})) for (const v of vs) headers.append(k, String(v))
  return new Response(out.isBase64Encoded ? Buffer.from(out.body, 'base64') : out.body, { status: out.statusCode, headers })
}

export const config = { path: '/api/*' }
