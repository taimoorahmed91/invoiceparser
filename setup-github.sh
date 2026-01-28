#!/bin/bash

# Invoice Parser - GitHub Setup Script
# This script helps you set up and push your code to GitHub

echo "🚀 Setting up GitHub repository for Invoice Parser..."

# Navigate to project directory
cd "$(dirname "$0")"

# Check if git is already initialized
if [ -d ".git" ]; then
    echo "✅ Git repository already initialized"
else
    echo "📦 Initializing git repository..."
    git init
fi

# Add all files
echo "📝 Adding files to git..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit. Files may already be committed."
else
    echo "💾 Creating initial commit..."
    git commit -m "Initial commit: Invoice Parser application"
fi

echo ""
echo "✅ Local git repository is ready!"
echo ""
echo "📋 Next steps:"
echo "1. Go to https://github.com/new and create a new repository"
echo "2. Name it 'invoice-parser' (or your preferred name)"
echo "3. DO NOT initialize with README, .gitignore, or license"
echo "4. After creating, run these commands:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/invoice-parser.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "   (Replace YOUR_USERNAME with your actual GitHub username)"
echo ""

