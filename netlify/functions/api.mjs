import serverless from 'serverless-http'
import { connectLambda } from '@netlify/blobs'
import { createApp } from '../../server/app.js'
import { blobStore } from '../../server/store.js'

let handle

export const handler = async (event, context) => {
  connectLambda(event) // gives @netlify/blobs its credentials in Lambda mode
  if (!handle) handle = serverless(createApp({ store: await blobStore() }))
  return handle(event, context)
}
