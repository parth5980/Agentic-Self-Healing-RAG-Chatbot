import app from "./src/app.js";
import connectDB from "./src/config/database.js";

connectDB();

app.listen("8080", () => {
  console.log("server is listening to port 8080.");
});
