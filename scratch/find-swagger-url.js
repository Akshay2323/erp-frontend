const baseUrl = "http://192.168.53.9:8000/";

async function run() {
  try {
    const res = await fetch(`${baseUrl}api/documentation`);
    const text = await res.text();
    // Look for any url or json patterns
    const matches = text.match(/url\s*:\s*['"][^'"]+['"]/g) || [];
    console.log("Matches for url:", matches);
    const jsonPaths = text.match(/[^'"\s]+\.json/g) || [];
    console.log("Matches for .json:", jsonPaths);
  } catch (err) {
    console.error(err);
  }
}

run();
