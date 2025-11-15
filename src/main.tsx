import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { ThreeProvider } from './context/threeContext';
import './styles.css';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'gray.50',
      },
    },
  },
  colors: {
    brand: {
      50: '#e3f9ff',
      100: '#b8edff',
      200: '#8be1ff',
      300: '#5ed4ff',
      400: '#31c7ff',
      500: '#17aee6',
      600: '#0987b4',
      700: '#006082',
      800: '#003a51',
      900: '#001421',
    },
  },
  fonts: {
    heading: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`,
    mono: `"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", "Consolas", "Courier New", monospace`,
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'lg',
      },
      variants: {
        solid: {
          bg: 'brand.500',
          color: 'white',
          _hover: {
            bg: 'brand.600',
            transform: 'translateY(-1px)',
            boxShadow: 'md',
          },
          _active: {
            bg: 'brand.700',
            transform: 'translateY(0)',
          },
        },
      },
    },
    Drawer: {
      baseStyle: {
        dialog: {
          bg: 'gray.800',
        },
        header: {
          borderBottomWidth: '1px',
          borderColor: 'gray.700',
          bg: 'gray.850',
        },
        body: {
          bg: 'gray.800',
        },
      },
    },
    Accordion: {
      baseStyle: {
        container: {
          borderColor: 'gray.700',
        },
        button: {
          bg: 'gray.750',
          _hover: {
            bg: 'gray.700',
          },
          _expanded: {
            bg: 'gray.700',
          },
        },
        panel: {
          bg: 'gray.800',
        },
      },
    },
    Slider: {
      baseStyle: {
        track: {
          bg: 'gray.700',
          borderRadius: 'full',
        },
        filledTrack: {
          borderRadius: 'full',
        },
        thumb: {
          bg: 'white',
          borderWidth: '2px',
          borderColor: 'brand.500',
          _focus: {
            boxShadow: '0 0 0 3px rgba(23, 174, 230, 0.3)',
          },
        },
      },
    },
    Menu: {
      baseStyle: {
        list: {
          bg: 'black',
          borderColor: 'gray.600',
          borderWidth: '1px',
        },
        item: {
          bg: 'transparent',
          color: 'gray.50',
          _hover: {
            bg: 'gray.700',
          },
          _focus: {
            bg: 'gray.700',
          },
        },
      },
    },
  },
  shadows: {
    outline: '0 0 0 3px rgba(23, 174, 230, 0.3)',
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      {/*
        Initialize global contexts here.
        For now, ThreeProvider can start with an empty object and be filled inside App.
      */}
      <ThreeProvider >
        <App />
      </ThreeProvider>
    </ChakraProvider>
  </React.StrictMode>
);