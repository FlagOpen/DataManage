**English** | [中文](README.zh.md)

# RoboCOIN DataManager

**Version: v1.1**

Live Demo: https://flagopen.github.io/RoboCOIN-DataManager/

## What is RoboCOIN DataManager?

RoboCOIN DataManager is a web app that helps you find and download robotic manipulation datasets from the RoboCOIN project. Instead of digging through complex commands, you can browse videos, filter by tags, pick what you need, and get ready-to-use download commands.

## 📋 Important Notice: Download Access

> **To improve user experience, understand user distribution, provide reference for future project development directions, and facilitate better compatibility for users in different regions in the future, we hope you can fill out a relevant information statistics survey before using the RoboCOIN dataset. This statistical information will be collected through official channels of Hugging Face or ModelScope, and will not be used for any other purposes except the above. Thank you for your support of the RoboCOIN project!**
>
> **To download any dataset, you must first apply for access on Hugging Face. Once your application is approved for any single dataset, you will automatically gain download permissions for all datasets in the RoboCOIN project.**
>
> 🔗 **Application Link**: [https://huggingface.co/RoboCOIN](https://huggingface.co/RoboCOIN)
>
> Click the link and select any dataset. You will need to fill in some necessary information on the dataset page before submitting your access request. Your application will be auto-approved immediately after submission. 

## How to download in one step?

Just click the download icon in the bottom-right corner of any video panel to directly copy the download command!

## How to batch download the data I want?

### Step 1: Open the website
Visit: https://flagopen.github.io/RoboCOIN-DataManager/

Wait for datasets to load (you'll see a progress bar).

### Step 2: Find the data you want
- **Browse videos**: Scroll through the video cards to see what robotic tasks are available
- **Use filters**: Click "Filter datasets" to narrow down by:
  - What room/scene (kitchen, living room, etc.)
  - What robot (Unitree, Agilex, etc.)
  - What action (pick up, place, etc.)
  - What objects (cups, boxes, etc.)
- **Search by name**: Use the search box to find specific datasets

### Step 3: Pick your datasets
- Click on video cards to select them, you can select multiple!
- Use "Select all" and "Deselect all" for quick full selection/deselection!
- The counter at the top shows how many datasets you've currently selected

### Step 4: Get download commands
- Look at the "Batch Downloader" panel on the right - all your selected datasets are here!
- Choose your preferred source: HuggingFace or ModelScope
- Click "Copy & Checkout" to copy the Python command

### Step 5: Download the data
1. **First, install RoboCOIN** (one time setup):
   ```bash
   pip install robocoin
   ```
   Pull the corresponding project first: https://github.com/FlagOpen/RoboCOIN

2. **Paste and run the command**:
   If needed, you can customize your own download target directory:
   ```bash
   ...--target-dir YOUR_TARGET_DOWNLOAD_DIR
   ```

3. **Wait for download** - RoboCOIN's download tool will handle everything automatically

That's it! Your data will be downloaded to your computer.

## More Features

### Save your selections
- Click "Export JSON" to save your current picks as a file
- Click "Import JSON" to load saved selections later
- Useful for sharing or continuing work later

## Need Help?

### Having trouble downloading?
1. Make sure you installed RoboCOIN: `pip install robocoin`
2. Check your internet connection to GitHub

### Found a bug or have questions?
- **Report issues**: [RoboCOIN GitHub](https://github.com/FlagOpen/RoboCOIN) or create an issue directly in this project
- **Email**: Feel free to contact pykerogers@outlook.com

### Learn more about RoboCOIN
- **Main project**: [github.com/FlagOpen/RoboCOIN](https://github.com/FlagOpen/RoboCOIN)
- **Documentation**: Check the main repo for dataset details and research usage
