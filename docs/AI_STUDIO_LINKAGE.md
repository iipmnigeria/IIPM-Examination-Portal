# Google AI Studio Workspace Linkage

## Purpose

This repository remains the only production source for AgileCert.

- Production repository: `iipmnigeria/IIPM-Examination-Portal`
- Production source branch: `supabase-integration`
- AI Studio workspace: `iipmnigeria/IIPM-Examination-Portal-AI-Studio-Workspace`
- Live domain: `https://agilecert.iipmi.org`

The AI Studio workspace is for development and testing only. It must never deploy directly to Namecheap, GitHub Pages, Supabase production, payment services, examinations, certificates or finance services.

## Required secret

Create one fine-grained GitHub token and save it in this production repository as:

`AI_STUDIO_WORKSPACE_TOKEN`

Give the token access only to `iipmnigeria/IIPM-Examination-Portal-AI-Studio-Workspace` with:

- Contents: Read and write
- Metadata: Read

Do not place this token in the AI Studio workspace.

## Production to workspace

Run **Sync production source to AI Studio workspace** from GitHub Actions.

The workflow copies the current `supabase-integration` source into the workspace branch `production-sync`. It preserves workspace-only mobile and AI Studio files and does not copy production deployment workflows.

Review the generated `production-sync` branch before merging it into the workspace `main` branch.

## Workspace to production

Create AI Studio changes on a branch based on `production-sync`.

Run **Promote AI Studio changes to production PR** in this repository and provide:

- workspace base ref, normally `production-sync`
- workspace head ref containing the AI Studio changes
- a short feature slug
- a pull-request title

The workflow imports only the difference between the two workspace refs, blocks production workflow and secret files, creates a new branch in this repository, and opens a draft pull request against `supabase-integration`.

Nothing is deployed until the draft pull request is reviewed, validated and merged through the normal production process.
