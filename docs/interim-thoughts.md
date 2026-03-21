# Interim Thoughts

Observations that don't have a home yet. May become principles, features, or nothing.

## Decomposition as pilot intervention

Agents frequently get stuck on problems where decomposition is the answer but they don't self-initiate it. They push harder on a monolithic approach rather than stepping back. The pilot should detect stuckness and intervene — forcing decomposition either temporally (pipeline of sequential steps) or structurally (independent sub-problems).

Shelf life: probably short. Expect models to internalise this within 12 months.

## Auth is the control surface

In an agentic world, authorisation and authentication become the most significant decisions a human makes. When agents act autonomously, the permission boundary *is* the control surface — everything else is delegation. If you're accountable for something, deciding who (and what) is allowed to act on it is the highest-leverage thing you can do.

This is boring, slow, and frustrating work. That's exactly why it'll be the differentiator — the companies that get agent adoption right won't have the smartest orchestration, they'll have the most thoughtful permission models.

## Prototype-to-product is a pilot decision

Agents will produce an explosion of prototypes. Knowing when to turn a prototype into a product engineering effort is a human judgement call — another pilot decision. The signal: when the pain of unrelated things failing becomes too high. That's when the accumulated tech debt of a prototype crosses the threshold and it's time to rebuild with proper engineering discipline.

## Automated flywheels need ground truth

Automated flywheels are only as valuable as their ground truth. If you don't have ground truth to test against, the AI doesn't know what good looks like — though it will probably tell you it does. Without a reliable oracle, automation just produces confident garbage faster.

## Automate the "ok test it now" loop

When the AI says "it's ready, do a test" — that's fine as a starting point, but the goal should be to automate those checks as much as possible. The blocker is often access: functionality gated behind authentication and security creates environments that agents can't reach. Managing test environments with appropriate access for automated validation is a standard infrastructure pattern that needs deliberate investment.
