import './webLayout';
import { registerRootComponent } from 'expo';
import HomeDemo from './HomeDemo';

// Separate entry: never imports the production App or its runtime mode.
registerRootComponent(HomeDemo);
