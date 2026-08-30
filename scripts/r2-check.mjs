import { AwsClient } from "aws4fetch";

/** Verifies the R2 credentials by writing, reading and deleting a test object. */
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
const key = "_healthcheck.txt";

const put = await client.fetch(`${base}/${key}`, {
  method: "PUT",
  body: "continuum r2 check",
  headers: { "Content-Type": "text/plain" },
});
console.log("  PUT   ", put.status, put.ok ? "ok" : await put.text());

const get = await client.fetch(`${base}/${key}`);
console.log("  GET   ", get.status, get.ok ? JSON.stringify(await get.text()) : "");

const del = await client.fetch(`${base}/${key}`, { method: "DELETE" });
console.log("  DELETE", del.status, del.ok ? "ok" : "");
