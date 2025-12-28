/**
 * Vuetify Plugin Configuration
 */

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default createVuetify({
	components,
	directives,
	theme: {
		defaultTheme: 'dark',
		themes: {
			dark: {
				dark: true,
				colors: {
					primary: '#7C4DFF',      // Deep purple accent
					secondary: '#00BFA5',    // Teal accent
					accent: '#FF6D00',       // Orange accent
					error: '#FF5252',
					info: '#2196F3',
					success: '#4CAF50',
					warning: '#FFC107',
					background: '#121212',
					surface: '#1E1E1E',
					'surface-bright': '#2D2D2D',
					'on-background': '#FFFFFF',
					'on-surface': '#FFFFFF',
				},
			},
			light: {
				dark: false,
				colors: {
					primary: '#651FFF',
					secondary: '#00BFA5',
					accent: '#FF6D00',
					error: '#FF5252',
					info: '#2196F3',
					success: '#4CAF50',
					warning: '#FFC107',
					background: '#FAFAFA',
					surface: '#FFFFFF',
				},
			},
		},
	},
	defaults: {
		VBtn: {
			variant: 'flat',
			rounded: 'lg',
		},
		VCard: {
			rounded: 'lg',
			elevation: 0,
		},
		VTextField: {
			variant: 'outlined',
			density: 'comfortable',
		},
		VTextarea: {
			variant: 'outlined',
		},
	},
})
