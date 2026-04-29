import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password } = req.body;

    // validation. However, we can write custom validations. I saw it in previous course.

    if (
        [fullName, email, username, password].some(
            (fields) => !fields || fields?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required.");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(
            409,
            "This user already exists with either email or username."
        );
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverimageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required. Please upload it.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    // I don't know what ChaiCode has written here, but let's see if he realises his mistake or if it is this is how it is written

    let coverImage = "";
    if (coverimageLocalPath) {
        coverImage = await uploadOnCloudinary(coverimageLocalPath);
    }

    // Till now, apart from uploading avatar and coverimage to the Cloudinary, we have just checked if the user exists and thrown errors. But now, if the user does not exists, we will create the user.

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken "
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user."
        );
    }

    return res
        .status(201)
        .json(
            new ApiResponse(200, createdUser, "User registered successfully.")
        );
});
export { registerUser };
