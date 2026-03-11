const express = require("express");
const router = express.Router();

const pythonClient = require("../services/pythonClient");

router.post("/", async (req, res) => {

    try {

        const { url } = req.body;

        if (!url) return res.json({ ok:false });

        await pythonClient.download(url);

        res.json({ ok:true });

    } catch (e) {
        console.log(e);
        res.json({ ok:false });
    }

});

module.exports = router;
