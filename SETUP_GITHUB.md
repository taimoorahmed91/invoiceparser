# Setting up GitHub Repository

Follow these steps to create and push your Invoice Parser project to GitHub:

## Step 1: Initialize Git (if not already done)
```bash
cd /Users/taimoorahmed/Library/CloudStorage/OneDrive-Cisco/InvoiceParser/invoice-parser
git init
```

## Step 2: Add all files
```bash
git add .
```

## Step 3: Create initial commit
```bash
git commit -m "Initial commit: Invoice Parser application"
```

## Step 4: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `invoice-parser` (or your preferred name)
3. Description: "Invoice parsing and management application"
4. Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 5: Add remote and push
After creating the repo, GitHub will show you commands. Use these:

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/invoice-parser.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Alternative: Using SSH (if you have SSH keys set up)
```bash
git remote add origin git@github.com:YOUR_USERNAME/invoice-parser.git
git branch -M main
git push -u origin main
```

## Note about data files
The `.gitignore` file is configured to exclude:
- `/data/*.json` - Invoice data files
- `/data/*.pdf` - PDF invoice files

This keeps your sensitive invoice data private. Only the code will be pushed to GitHub.

