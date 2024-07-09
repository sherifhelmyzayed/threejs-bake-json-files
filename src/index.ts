// Greetings
const sem_version = process.env.SEM_VERSION as string;
console.log(`Playground v${sem_version}`);

// Read query params
const searchParams = (new URL(location.href)).searchParams;
const isSilent = searchParams.has('silent');
const isDebug = searchParams.has('debug');
const isLocalhost = location.href.startsWith('https://localhost:');

if(isSilent)
{
    if(isDebug || isLocalhost) console.error('SILENT MODE\nconsole.log/warn are disabled');
    console.log = console.warn = function () {};
}

// Setup
import './index.css';
import * as Demo from './Demo';

window.addEventListener('load', ev =>
{
    const screenElement = document.getElementById('screen') as HTMLDivElement;
    screenElement.appendChild(Demo.getDomElement());

    Demo.createDemo();

    const resizeHandler = () => {
        const cs = getComputedStyle(screenElement);
        const width = Math.abs(Math.floor(Number.parseFloat(cs.width)));
        const height = Math.abs(Math.floor(Number.parseFloat(cs.height)));
        Demo.resize(width, height);
    };

    const debouncedResize = debounce(100, resizeHandler);
    window.addEventListener('resize', debouncedResize);
    screenElement.addEventListener('fullscreenchange', debouncedResize);
    debouncedResize();
});

// utils

function debounce(delay: number, callback: (...args: any[]) => void)
{
    let debouncedArgs: any[];
    let debouncedTimeoutID = 0;
    const debouncedCallback = () => callback(...debouncedArgs);
    
    const call = (...args: any[]) => {
        window.clearTimeout(debouncedTimeoutID);
        debouncedArgs = args;
        debouncedTimeoutID = window.setTimeout(debouncedCallback, delay);
    };
    return call;
}
