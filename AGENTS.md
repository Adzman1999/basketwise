<API_TASKS>
Before responding to any non-trivial API engineering task — designing, implementing, mocking, testing, monitoring, documenting, or deploying an API or Postman Flow — read `postman/skills/api-engineer/SKILL.md` and follow it. Load the relevant task-specific Postman skill when needed. Pure questions and trivial one-line edits do not need it.
</API_TASKS>

<UI_COMPONENTS>
Use shadcn/ui as Basketwise's default component library for all web UI. Reuse the existing components in `apps/web/src/components/ui` and add shadcn components through the CLI when needed. Build custom UI only when the existing shadcn components cannot support the requirement, and keep styling on the shared semantic theme tokens so light and dark mode both work.
</UI_COMPONENTS>
