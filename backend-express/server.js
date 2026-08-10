import app from "./src/app.js";
import connectDB from "./src/config/database.js";

import dns from "dns"; 
dns.setServers(['8.8.8.8', '1.1.1.1']);

connectDB();

app.listen("8080", () => {
  console.log("server is listening to port 8080.");
});
