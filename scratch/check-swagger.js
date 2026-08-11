const token = "20|jcWRLjvjqJ4yicvv5OZgaoKkR77ujO0lcQkmVjkNcbc68bb3";
const baseUrl = "http://192.168.53.9:8000/";

async function tryDoc(path) {
  console.log(`Checking ${path}...`);
  try {
    const res = await fetch(`${baseUrl}${path}`);
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      console.log(`  Content snippet:`, text.slice(0, 500));
      if (text.includes("openapi") || text.includes("swagger")) {
        console.log(`  FOUND SWAGGER AT ${path}!`);
      }
    }
  } catch (err) {
    console.log(`  Error:`, err.message);
  }
}

async function run() {
  await tryDoc("api/documentation");
  await tryDoc("docs/api-docs.json");
  await tryDoc("api/oauth/scopes");
  await tryDoc("docs/v1/api-docs.json");
  await tryDoc("api/docs/api-docs.json");
  await tryDoc("api/v1/documentation");
}

run();
