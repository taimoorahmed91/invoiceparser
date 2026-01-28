# Git Commit Commands

Run these commands in your terminal from the invoice-parser directory:

## Step 1: Navigate to the project directory
```bash
cd /Users/taimoorahmed/Library/CloudStorage/OneDrive-Cisco/InvoiceParser/invoice-parser
```

## Step 2: Check git status
```bash
git status
```

## Step 3: Add all changes
```bash
git add .
```

## Step 4: Commit with a descriptive message
```bash
git commit -m "Update invoice features: edit functionality, improved toolbar, monthly sums, and graph tooltip fixes"
```

Or if you prefer a more detailed message:
```bash
git commit -m "Add invoice edit functionality with type and amount editing

- Add pencil icon button to edit invoices in dashboard table
- Implement edit form with type dropdown and amount inputs (net, tax, gross)
- Auto-calculate gross total from net + tax
- Improve toolbar layout with dropdown menus for File and Export
- Fix rental graph tooltip to show correct month/year data
- Change Monthly Averages to Monthly Sum with sum calculation
- Update X-axis labels to show year when duplicate months exist"
```

## Step 5: Push to remote repository
```bash
git push
```

If you haven't set up a remote yet, first add it:
```bash
git remote add origin https://github.com/YOUR_USERNAME/invoice-parser.git
git branch -M main
git push -u origin main
```

## If you need to check what files changed:
```bash
git diff --name-only
```

## If you want to see the changes:
```bash
git diff
```


