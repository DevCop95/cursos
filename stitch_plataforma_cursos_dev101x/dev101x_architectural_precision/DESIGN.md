---
name: Dev101x Architectural Precision
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#3e4943'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#6e7a73'
  outline-variant: '#bdc9c1'
  surface-tint: '#006c4e'
  primary: '#005d42'
  on-primary: '#ffffff'
  primary-container: '#047857'
  on-primary-container: '#9ffdd3'
  inverse-primary: '#7bd8b1'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#005d3f'
  on-tertiary: '#ffffff'
  tertiary-container: '#007853'
  on-tertiary-container: '#8fffcb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#97f5cc'
  primary-fixed-dim: '#7bd8b1'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#00513a'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.025em
  display-md-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.025em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a high-trust, mission-critical educational environment tailored for senior engineers, enterprise analysts, and security practitioners studying Cybersecurity and Artificial Intelligence. The design ethos projects technical rigor, calm authority, and academic credibility.

The visual direction rejects neon cyberpunk tropes, decorative skeuomorphism, and superfluous glowing effects. Instead, it embraces an architectural modernism: precise 1px hairline structural frames, pure snow-white negative space, dense charcoal typography, and surgical emerald accents. The aesthetic balance reflects executive clarity and engineering discipline—evoking the clean reliability of developer infrastructure consoles combined with the editorial prestige of modern technical journals.

## Colors

The palette is strictly flat, opaque, and controlled to eliminate visual noise and guarantee WCAG AAA reading compliance.

- **Canvas & Surfaces**: The base canvas is absolute white (`#FFFFFF`). Subordinate surfaces, code containers, and inactive regions transition to crisp, clinical cool off-whites (`#F8FAFC` and `#F1F5F9`).
- **Dividers & Structural Borders**: Delimited by calibrated hairlines (`#E2E8F0` for primary layout grids, `#EAECF0` for subtle nested components).
- **Text & Structure**: Primary headlines, metrics, and core structural outlines use deep slate-black (`#0F172A`). Secondary body text, instructional guidance, and table metadata use focused charcoal (`#1E293B` and `#475569`).
- **Emerald Accent Matrix**: Systematic technical green accents represent verified status, active modules, terminal anchors, and progressive mastery. We deploy deep forest emerald (`#064E3B`) for heavy contrast elements and active states, balanced emerald (`#047857` and `#059669`) for primary indicators and interactive nodes, and mid emerald (`#10B981`) solely for small status dots and inline terminal badges. Gradients are prohibited across all UI surfaces.

## Typography

The typographic scale combines structural clarity with engineering ergonomics.

- **Primary Typeface (`Plus Jakarta Sans`)**: Delivers clear letterforms, deep geometric counters, and exceptional legibility across dense curriculum indices, lesson scripts, and laboratory documentation. Tight negative letter-spacing is applied systematically to headers to yield an editorial, calibrated finish.
- **Data & Metadata Typeface (`JetBrains Mono`)**: Applied to course taxonomies, terminal snippets, cyber attack vectors, AI model checkpoints, module durations, and badge metrics to reinforce technical discipline.
- **Rhythm & Hierarchy**: Display sizes drop proportionately on mobile screens to preserve scan paths without clipping vertical space. Line lengths for technical explanations are capped at 68 characters to sustain high comprehension speeds.

## Layout & Spacing

The layout is built upon an 8pt architectural grid mapped across a responsive 12-column framework.

- **Desktop (1200px+)**: 12-column layout with a 1280px maximum content container. Outer margins set at `margin-desktop` (3rem), gutters at `gutter` (1.5rem). Column arrangements favor asymmetric splits (e.g., 8-column syllabus/editor workspace paired with a 4-column module index and lab execution status rail).
- **Tablet (768px – 1199px)**: 8-column layout with 2rem margins and 1.5rem gutters. Secondary contextual sidebars collapse into sticky bottom or top drawer bars.
- **Mobile (320px – 767px)**: 4-column layout with 1rem margins and 1rem gutters. Grids compress strictly into vertical stacks with unified card margins.
- **Padding Philosophy**: Component containers employ generous internal whitespace (`space-lg` to `space-xl`) against sharp 1px frames, maintaining readability during extended technical study sessions.

## Elevation & Depth

Visual depth is produced using structural framing, sharp division lines, and muted ambient micro-shadows rather than heavy multi-layer drop shadows.

- **Baseline Level (Level 0)**: Pure white background (`#FFFFFF`) or subtle canvas grey (`#F8FAFC`). No shadow. Separation is generated exclusively by a 1px solid border (`#E2E8F0`).
- **Card Rest Level (Level 1)**: Pure white surface with a 1px solid outline (`#E2E8F0`) augmented by a razor-thin, cold micro-shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Card Interactive / Hover Level (Level 2)**: Upon cursor interaction, cards do not lift high off the page. The border shifts to `#047857` (or dark slate `#0F172A` depending on context), supported by a crisp, low-diffusion shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Modals, Flyouts & Drawers (Level 3)**: Structural overlays utilize an opaque 1px border (`#E2E8F0`) with a calibrated ambient occlusion shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.03)`. Backdrops use `#0F172A` at 40% opacity without heavy blur to retain razor-sharp workspace contrast.

## Shapes

The design system enforces a disciplined, low-radius shape language (`roundedness: 1`). 

- **Primary Geometry**: Standard containers, cards, and input fields use an exact `0.25rem` (4px) border radius.
- **Mid-size Modals & Panels (`rounded-lg`)**: Use `0.5rem` (8px) radius, preventing visual heaviness while avoiding harsh industrial corners.
- **System Tags, Indicators & Badges**: Small informational flags and pill-tags can use `9999px` strictly when indicating binary states (e.g., live vulnerability feeds or model compilation indicators), but all structural containers remain strictly low-radius architectural blocks.

## Components

### Buttons
- **Primary**: Solid background in Deep Slate (`#0F172A`) with pure white text (`#FFFFFF`), or Forest Emerald (`#047857`) for primary call-to-actions (e.g., "Deploy Cloud Lab"). Height: 40px (desktop), border-radius: 4px, font-family: `Plus Jakarta Sans`, 600 weight. Hover state: `#064E3B` or `#1E293B`. Never use gradients or glowing borders.
- **Secondary / Outline**: 1px solid `#E2E8F0`, pure white surface, `#0F172A` typography. Hover: border color shifts to `#0F172A` with `#F8FAFC` background.
- **Ghost / Utility**: No border, `#1E293B` text, shifts to `#F1F5F9` on hover.

### Cards & Lab Containers
- **Construction**: 1px border `#E2E8F0`, `#FFFFFF` fill, 4px border-radius.
- **Header**: Divided by a 1px horizontal hairline `#EAECF0` with padded metadata using `JetBrains Mono` for course code and difficulty index.
- **Hover Behavior**: Hairline shifts from `#E2E8F0` to `#047857` without scale transformation.

### Badges & Status Chips
- **Taxonomy**: Applied to AI model tags (e.g., `LLM-ORCHESTRATION`, `RED-TEAM-OPS`).
- **Visuals**: Flat fill `#F1F5F9` with a 1px border `#E2E8F0`, `#0F172A` text, font: `JetBrains Mono` (11px, 500 weight).
- **Active / Verified Status**: Tinted emerald variant with light mint surface (`#ECFDF5`), 1px border (`#A7F3D0`), text `#064E3B`, and an unblurred, solid 6px status dot (`#059669`).

### Input Fields & Terminal Consoles
- **Inputs**: 1px border `#E2E8F0`, 40px height, 4px radius, `#0F172A` text, `#94A3B8` placeholder. Focus state transitions to a 1px solid border `#047857` with an ambient 1px outer ring in `#047857` (no blurred diffuse spreads).
- **Terminal Snippets**: Deep slate background (`#0F172A`) framed by a 1px border (`#1E293B`), utilizing `#F8FAFC` monospaced code text with syntax highlights in non-fluorescent emerald (`#10B981`) and muted slate blue (`#94A3B8`).

### Checkboxes & Radio Controls
- **Form**: 16px square (checkbox) or circle (radio), 1px border `#CBD5E1`, surface `#FFFFFF`. Checked state fills `#047857` with a crisp, geometric white checkmark or center dot. Focus ring: 2px offset solid `#047857`.

### Course Curricula & Metric Lists
- **Structure**: Clean tabular lists bounded by subtle 1px dividers (`#EAECF0`). Alternating row highlights are omitted in favor of clear hover states (`#F8FAFC`). Left-side micro indicators in `#047857` denote lesson progression.