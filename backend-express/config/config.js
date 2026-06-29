import dotenv from "dotenv";

dotenv.config();

if(!process.env.MongoURI){
    throw new Error("MongoURI is not defined in environment vatiables");
}

const config = {
    MongoURI : process.env.MongoURI
};

export default config;