const main = require('./main');
const post = require('./post');

if (!post.IsPost) {
    await main.Main();
} else {
    await post.Post();
}
