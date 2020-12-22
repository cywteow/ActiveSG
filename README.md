# ActiveSGBadminton

I must admit this code is pretty messy but still workable.

I rushed this out in 1 day to explore, learn and fit my needs.

I find that puppeteer is pretty powerful and I think it's possible to inject script/code into the headless chrome's browser context

and make use of activesg's `httpOnly` cookie/credentials to execute HttpRequest using pure Javascript ways like fetch/XMLHttpRequest/Ajax.

It's even possible to run methods from their javascript's library from `vendor.min.js`. e.g `CS.get("facilities/ajax/getTimeslots", params)`

Will try to refractor when I have time.