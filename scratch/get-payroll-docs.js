const fs = require('fs');
const path = require('path');

const url = "http://192.168.53.9:8000/docs?api-docs.json";

async function run() {
  console.log("Fetching API docs...");
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log("Keys in API docs:", Object.keys(json));
    
    // Save the whole file
    fs.writeFileSync(path.join(__dirname, 'api-docs.json'), JSON.stringify(json, null, 2));
    console.log("Saved api-docs.json");
    
    // Filter paths containing '/payroll/'
    const payrollPaths = {};
    if (json.paths) {
      for (const [p, val] of Object.entries(json.paths)) {
        if (p.includes('/payroll/')) {
          payrollPaths[p] = val;
        }
      }
    }
    
    console.log("Found payroll paths:", Object.keys(payrollPaths));
    fs.writeFileSync(path.join(__dirname, 'payroll-api-docs.json'), JSON.stringify(payrollPaths, null, 2));
    console.log("Saved payroll-api-docs.json");
    
    // If there are schemas in components, filter them as well
    const schemas = json.components?.schemas || {};
    const payrollSchemas = {};
    for (const [sName, sVal] of Object.entries(schemas)) {
      if (sName.toLowerCase().includes('payroll') || sName.toLowerCase().includes('salary') || sName.toLowerCase().includes('component')) {
        payrollSchemas[sName] = sVal;
      }
    }
    fs.writeFileSync(path.join(__dirname, 'payroll-schemas.json'), JSON.stringify(payrollSchemas, null, 2));
    console.log("Saved payroll-schemas.json");

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
