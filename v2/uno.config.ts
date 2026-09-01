import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/'
    })
  ],
  theme: {
    colors: {
      accent: {
        DEFAULT: 'var(--accent)',
        light: 'var(--accent-light)',
        hover: 'var(--accent-hover)'
      }
    }
  },
  shortcuts: {
    'card-base': 'bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,.02),0_4px_16px_rgba(0,0,0,.04),0_1px_0_rgba(255,255,255,.6)_inset] border border-black/[.025] transition-shadow duration-300',
    'card-hover': 'hover:shadow-[0_1px_2px_rgba(0,0,0,.02),0_8px_24px_rgba(0,0,0,.05),0_1px_0_rgba(255,255,255,.6)_inset]',
    'module-title': 'flex items-center gap-2 px-[22px] pt-[18px] pb-2.5',
    'btn-primary': 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold cursor-pointer border border-accent shadow-[0_1px_2px_rgba(58,107,76,.2),0_4px_12px_rgba(58,107,76,.15)] transition-all hover:bg-accent-hover hover:-translate-y-px active:translate-y-0',
    'btn-ghost': 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[var(--text-2)] text-[13px] cursor-pointer border border-[var(--border)] transition-all hover:border-accent hover:text-accent hover:bg-accent-light'
  }
})
