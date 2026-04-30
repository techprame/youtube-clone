import app from "./app.js";
import "dotenv/config.js";
import connectDB from "./db/index.js";

const PORT = process.env.PORT;

connectDB()
    .then(
        app.listen(PORT, (req, res) => {
            console.log(`The server is running at http://localhost:${PORT}`);
        })
    )
    .catch((error) => {
        console.log(`MongoDB Connection error, ${error}`);
    });
