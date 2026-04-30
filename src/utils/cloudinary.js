import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import "dotenv/config.js";

// Configuration

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload on Cloudinary

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            return null;
        }

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        // console.log(`File uploaded successfully. File Source: ${response.url}`);

        // Once the file is uploaded to the cloudinary, we can delete the file from local storage as well.

        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);
        return null;
    }
};

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log("Deleted from Cloudinary. Public ID:", publicId);
    } catch (error) {
        console.log("Error deleting from Cloudinary", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteFromCloudinary };
