import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import "dotenv/config.js";
import jwt from "jsonwebtoken";

import { User } from "../models/user.models.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found.");
        }
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating Access and Refresh Token"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { fullname, email, username, password } = req.body;

    // validation. However, we can write custom validations. I saw it in previous course.

    if (
        [fullname, email, username, password].some(
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

    try {
        const user = await User.create({
            fullname,
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
                new ApiResponse(
                    200,
                    createdUser,
                    "User registered successfully."
                )
            );
    } catch (error) {
        console.log("User creation failed.");
        if (avatar) {
            await deleteFromCloudinary(avatar.public_id);
        }
        if (coverImage) {
            await deleteFromCloudinary(coverImage.public_id);
        }
        throw new ApiError(
            500,
            "Something went wrong while registering the user and images from Cloudinary deleted as well."
        );
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required.");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Password is not correct.");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!loggedInUser) {
        throw new ApiError(
            500,
            "Something went wrong while logging in the user."
        );
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("RefreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: undefined } },
        { new: true }
    );

    // Now, since we removed the refreshToken and hence, logged out the user, it's the time to release the cookies as well from the browser.

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    };

    res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User has been logged out successfully.")
        );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required.");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh Token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Invalid refresh Token");
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        };

        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshToken(user._id);
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully."
                )
            );
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while refreshing access Token."
        );
    }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
